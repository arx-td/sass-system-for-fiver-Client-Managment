import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { FiverrAccountsService } from './fiverr-accounts.service';
import { CreateFiverrAccountDto, UpdateFiverrAccountDto } from './dto';
import { JwtAuthGuard, RolesGuard } from '@/common/guards';
import { Roles, CurrentUser } from '@/common/decorators';

@ApiTags('fiverr-accounts')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('fiverr-accounts')
export class FiverrAccountsController {
  constructor(private readonly fiverrAccountsService: FiverrAccountsService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new Fiverr account (Admin only)' })
  @ApiResponse({ status: 201, description: 'Account created successfully' })
  @ApiResponse({ status: 409, description: 'Account name already exists' })
  async create(
    @Body() createDto: CreateFiverrAccountDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.fiverrAccountsService.create(createDto, userId);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all Fiverr accounts (Admin only)' })
  @ApiResponse({ status: 200, description: 'List of Fiverr accounts' })
  async findAll() {
    const accounts = await this.fiverrAccountsService.findAll();
    // Return in paginated format expected by frontend
    return {
      data: accounts,
      total: accounts.length,
      page: 1,
      limit: accounts.length,
      totalPages: 1,
    };
  }

  @Get('active')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get all active Fiverr accounts (Admin/Manager)' })
  @ApiResponse({ status: 200, description: 'List of active accounts' })
  async findAllActive() {
    return this.fiverrAccountsService.findAllActive();
  }

  @Get('stats')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get Fiverr account statistics (Admin only)' })
  @ApiResponse({ status: 200, description: 'Account statistics' })
  async getStats() {
    return this.fiverrAccountsService.getStats();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get Fiverr account by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'Account details' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async findOne(@Param('id') id: string) {
    return this.fiverrAccountsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update Fiverr account (Admin only)' })
  @ApiResponse({ status: 200, description: 'Account updated' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateFiverrAccountDto,
  ) {
    return this.fiverrAccountsService.update(id, updateDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete Fiverr account (Admin only)' })
  @ApiResponse({ status: 200, description: 'Account deleted' })
  @ApiResponse({ status: 400, description: 'Cannot delete account with projects' })
  async remove(@Param('id') id: string) {
    return this.fiverrAccountsService.remove(id);
  }
}
