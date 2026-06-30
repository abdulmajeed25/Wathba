import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { JwtPayload } from '../identity/auth.service';
import { CommentsService } from './comments.service';
import { CreateCommentDto, ListCommentsQueryDto } from './dto/comment.dto';

@ApiTags('comments')
@Controller('projects/:projectId/comments')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get()
  @ApiOperation({ summary: 'List comments (pinned-first, cursor-paginated)' })
  async list(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Query() q: ListCommentsQueryDto,
  ) {
    return this.comments.list(projectId, q);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Post a comment (backers only)' })
  async create(
    @CurrentUser() jwt: JwtPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.comments.create(jwt.sub, projectId, dto);
  }

  @Patch(':commentId/pin')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle pinned (creator only)' })
  async pin(
    @CurrentUser() jwt: JwtPayload,
    @Param('projectId', new ParseUUIDPipe()) _projectId: string,
    @Param('commentId', new ParseUUIDPipe()) commentId: string,
  ) {
    return this.comments.togglePin(jwt.sub, commentId);
  }

  @Patch(':commentId/hide')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle hidden (creator only)' })
  async hide(
    @CurrentUser() jwt: JwtPayload,
    @Param('projectId', new ParseUUIDPipe()) _projectId: string,
    @Param('commentId', new ParseUUIDPipe()) commentId: string,
  ) {
    return this.comments.toggleHide(jwt.sub, commentId);
  }

  @Delete(':commentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete comment (author or project creator)' })
  async remove(
    @CurrentUser() jwt: JwtPayload,
    @Param('projectId', new ParseUUIDPipe()) _projectId: string,
    @Param('commentId', new ParseUUIDPipe()) commentId: string,
  ) {
    return this.comments.remove(jwt.sub, commentId);
  }
}
