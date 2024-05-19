import { IsNumber } from 'class-validator';

export class CreateSessionRequest {
  @IsNumber()
  productId: number;
}
