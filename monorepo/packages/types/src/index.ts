import { z } from 'zod';

// build mode env variable enum
export const AppEnvironmentSchema = z.enum([
    'development',
    'production',
    'test'
]);
export type AppEnvironment = z.infer<typeof AppEnvironmentSchema>;
