import { Global, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

@Global()
@Module({
    imports: [
      HttpModule.register({
        // Here you can configure Axios' global settings
        timeout: 30000,
        maxRedirects: 5,
      }),
    ],
    exports: [HttpModule],
  })
export class AxiosModule {}
