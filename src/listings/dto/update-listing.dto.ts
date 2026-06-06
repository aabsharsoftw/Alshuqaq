import { PartialType } from '@nestjs/swagger';
import { CreateListingDto } from './create-listing.dto';

/**
 * All fields optional. Location/area is intentionally editable per the
 * product requirement.
 */
export class UpdateListingDto extends PartialType(CreateListingDto) {}
