import { ArrayMaxSize, ArrayMinSize, IsArray, IsMongoId } from 'class-validator';

/**
 * A bounded list of invoice ids for bulk operations.
 */
export class BulkIdsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsMongoId({ each: true })
  ids!: string[];
}
