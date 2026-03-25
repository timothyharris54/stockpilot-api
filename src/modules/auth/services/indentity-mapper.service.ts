import { Injectable, UnauthorizedException } from '@nestjs/common';
import { RequestIdentity } from '../interfaces/request-identity.interface';

@Injectable()
export class IdentityMapperService {
  toRequestIdentity(payload: any): RequestIdentity {
    if (!payload?.sub || !payload?.accountId || !payload?.email) {
      throw new UnauthorizedException('Invalid authentication payload.');
    }

    try {
      return {
        userId: BigInt(payload.sub),
        accountId: BigInt(payload.accountId),
        email: String(payload.email),
      };
    } catch {
      throw new UnauthorizedException('Invalid authentication payload.');
    }
  }
}