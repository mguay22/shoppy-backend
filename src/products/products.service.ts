import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateProductRequest } from './dto/create-product.request';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Subject } from 'rxjs';
import { ProductsGateway } from './products.gateway';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ProductsService {
  private readonly productsUpdated = new Subject<void>();
  readonly productsUpdated$ = this.productsUpdated.asObservable();
  private readonly s3Client = new S3Client({
    region: 'us-east-1',
  });
  private readonly bucket = 'shoppy-app';

  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    private readonly productsGateway: ProductsGateway,
  ) {}

  async createProduct(data: CreateProductRequest, userId: number) {
    const product = await this.prismaService.product.create({
      data: {
        ...data,
        userId,
      },
    });
    this.productsGateway.handleProductUpdated();
    return product;
  }

  async getProducts(status?: string) {
    const args: Prisma.ProductFindManyArgs = {};
    if (status === 'availible') {
      args.where = { sold: false };
    }
    const products = await this.prismaService.product.findMany(args);
    return Promise.all(
      products.map(async (product) => ({
        ...product,
        imageExists: await this.imageExists(product.id),
      })),
    );
  }

  async getProduct(productId: number) {
    try {
      return {
        ...(await this.prismaService.product.findUniqueOrThrow({
          where: { id: productId },
        })),
        imageExists: await this.imageExists(productId),
      };
    } catch (err) {
      throw new NotFoundException(`Product not found with ID ${productId}`);
    }
  }

  async update(productId: number, data: Prisma.ProductUpdateInput) {
    await this.prismaService.product.update({
      where: { id: productId },
      data,
    });
    this.productsGateway.handleProductUpdated();
  }

  async uploadProductImage(productId: string, file: Buffer) {
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: `${productId}.jpg`,
        Body: file,
      }),
    );
  }

  private async imageExists(productId: number) {
    try {
      const { Body } = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: `${productId}.jpg`,
        }),
      );
      return !!Body;
    } catch (err) {
      return false;
    }
  }
}
