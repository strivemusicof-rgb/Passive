import { BadRequestException, Body, type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

class ZodPipe implements PipeTransform {
  constructor(private readonly schema: z.ZodType) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value ?? {});
    if (!result.success) {
      throw new BadRequestException({
        code: 'validation_failed',
        issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    return result.data;
  }
}

/** Validates the request body with a zod schema: `@ZodBody(Schema) body`. */
export const ZodBody = (schema: z.ZodType) => Body(new ZodPipe(schema));
