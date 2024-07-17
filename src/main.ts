import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import defaultConfig from './config/default.config';
import { ConfigType } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import * as os from 'os';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Main')
  const config: ConfigType<typeof defaultConfig> = app.get(defaultConfig.KEY)
  await app.listen(config.port, () => {
    const server = app.getHttpServer()
    const address = server.address()
    const ipv4 = Object.values(os.networkInterfaces())
      .flatMap(iface => iface)
      .find(iface => iface.family === 'IPv4' && !iface.internal);
    const ipAddress = ipv4 ? ipv4.address : address.address;
    logger.log(`App is running on: http://${ipAddress}:${address.port}`)
  });
}
bootstrap();