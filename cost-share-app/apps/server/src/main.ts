/**
 * Main entry point for NestJS server
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // Enable CORS for mobile app
    app.enableCors({
        origin: '*',
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        credentials: true,
    });

    // Global prefix for all routes
    app.setGlobalPrefix('api');

    const port = process.env.PORT || 3000;
    await app.listen(port, '0.0.0.0');  // Listen on all network interfaces

    console.log(`🚀 Server is running on: http://localhost:${port}/api`);
    console.log(`📱 Ready to accept requests from mobile app`);
    console.log(`📱 Mobile devices can connect to: http://172.20.10.2:${port}/api`);
}

bootstrap();
