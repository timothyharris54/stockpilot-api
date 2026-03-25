import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RequestIdentity } from '../interfaces/request-identity.interface';

@Injectable()
export class AuthTokenService {
  constructor(private readonly jwtService: JwtService) {}

  async signAccessToken(identity: RequestIdentity): Promise<string> {
    return this.jwtService.signAsync({
      sub: identity.userId.toString(),
      accountId: identity.accountId.toString(),
      email: identity.email,
    });
  }
}