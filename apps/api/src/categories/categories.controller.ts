import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';

/** Batch CAT — public taxonomy reader for the mega-menu + discover pages. */
@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Full active category tree (top-level → subcategories) with LIVE counts' })
  async tree() {
    return this.categories.getTree();
  }

  @Get(':slug')
  @ApiOperation({ summary: 'One top-level category node + children + LIVE counts' })
  async bySlug(@Param('slug') slug: string) {
    return this.categories.getBySlug(slug);
  }
}
