import { Controller, Post, UseInterceptors, UploadedFile, ParseFilePipeBuilder, HttpStatus, UseGuards, Request } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: 'spreadsheet|excel|vnd.openxmlformats-officedocument.spreadsheetml.sheet|csv',
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        }),
    )
    file: Express.Multer.File,
    @Request() req,
  ) {
    const summary = await this.chatService.processExcelFile(file.buffer, req.user.userId);
    return { message: 'File processed successfully', summary };
  }
}
