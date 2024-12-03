import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        return next.handle().pipe(
            map((data) => {
                return {
                    code: 0,
                    data: data ?? {},
                    errorMessage: ''
                };
            }),
            catchError((err) => {
                // Catching exceptions and returning standardized error responses
                return throwError(() => {
                    return {
                        code: -1,
                        data: {},
                        errorMessage: err.message || 'Internal Server Error',
                    };
                });
            }),
        );
    }
}
