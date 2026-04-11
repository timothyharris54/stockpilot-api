import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, _info: any, ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    if (user) {
      req.identity = user;
    }

    if (err || !user) {
      throw err || new UnauthorizedException();
    }

    return user;
  }
}
