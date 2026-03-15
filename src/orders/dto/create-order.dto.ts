export class CreateOrderLineDto {
  productId?: number;
  sku?: string;
  productName?: string;
  quantity!: number;
  unitPrice?: number;
  lineTotal?: number;
  channelLineId?: string;
}

export class CreateOrderDto {
  channel!: string;
  channelOrderId!: string;
  status!: string;
  orderDate!: Date;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddress?: string;
  billingAddress?: string;
  currencyCode?: string;
  orderTotal?: number;
  orderLines!: CreateOrderLineDto[];
}