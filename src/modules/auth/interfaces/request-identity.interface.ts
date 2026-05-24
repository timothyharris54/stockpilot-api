import { UserRoleCode } from '@prisma/client';

export interface RequestIdentity {
  userId: bigint;
  accountId: bigint;
  email: string;
  roleCode: UserRoleCode;
}
