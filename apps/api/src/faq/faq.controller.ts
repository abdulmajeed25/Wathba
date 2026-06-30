import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { JwtPayload } from '../identity/auth.service';
import { FaqService } from './faq.service';
import {
  AnswerFaqQuestionDto,
  AskFaqDto,
  CreateFaqItemDto,
  UpdateFaqItemDto,
} from './dto/faq.dto';

@ApiTags('faq')
@Controller('projects/:projectId/faq')
export class FaqController {
  constructor(private readonly faq: FaqService) {}

  // ---- public FAQ accordion ----

  @Get()
  @ApiOperation({ summary: 'Public list of FAQ items for a project (sortOrder asc)' })
  async list(@Param('projectId', new ParseUUIDPipe()) projectId: string) {
    const items = await this.faq.listItems(projectId);
    return { items: items.map((i) => this.faq.toPublicItem(i)) };
  }

  // ---- creator FAQ CRUD ----

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a FAQ item (creator-only)' })
  async create(
    @CurrentUser() jwt: JwtPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: CreateFaqItemDto,
  ) {
    const i = await this.faq.createItem(jwt.sub, projectId, dto);
    return this.faq.toPublicItem(i);
  }

  @Patch(':itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Patch a FAQ item (creator-only)' })
  async update(
    @CurrentUser() jwt: JwtPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
    @Body() dto: UpdateFaqItemDto,
  ) {
    const i = await this.faq.updateItem(jwt.sub, projectId, itemId, dto);
    return this.faq.toPublicItem(i);
  }

  @Delete(':itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a FAQ item (creator-only)' })
  async remove(
    @CurrentUser() jwt: JwtPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
  ) {
    return this.faq.removeItem(jwt.sub, projectId, itemId);
  }

  // ---- "اسأل المبدع" — incoming questions ----

  @Post('ask')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ask the creator a question (auth required)' })
  async ask(
    @CurrentUser() jwt: JwtPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: AskFaqDto,
  ) {
    const q = await this.faq.ask(jwt.sub, projectId, dto);
    return this.faq.toPublicQuestion(q);
  }

  @Get('questions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List PENDING/ANSWERED questions for triage (creator-only)' })
  async listQuestions(
    @CurrentUser() jwt: JwtPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ) {
    const items = await this.faq.listQuestions(jwt.sub, projectId);
    return { items: items.map((q) => this.faq.toPublicQuestion(q)) };
  }

  @Post('questions/:qId/answer')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Answer a question; when publish=true (default) a new FaqItem is created and the asker is notified.',
  })
  async answer(
    @CurrentUser() jwt: JwtPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('qId', new ParseUUIDPipe()) qId: string,
    @Body() dto: AnswerFaqQuestionDto,
  ) {
    const { question, item } = await this.faq.answer(jwt.sub, projectId, qId, dto);
    return {
      question: this.faq.toPublicQuestion(question),
      item: item ? this.faq.toPublicItem(item) : null,
    };
  }
}
