import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { ContactsModule } from './contacts/contacts.module';
import { ScanModule } from './scan/scan.module';
import { VoiceModule } from './voice/voice.module';
import { DuplicatesModule } from './duplicates/duplicates.module';
import { RelationshipsModule } from './relationships/relationships.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    DatabaseModule,
    ContactsModule,
    ScanModule,
    VoiceModule,
    DuplicatesModule,
    RelationshipsModule,
  ],
})
export class AppModule {}
