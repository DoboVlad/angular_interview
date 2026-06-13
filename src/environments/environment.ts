export const environment = {
  production: false,
  anthropicApiUrl: 'https://api.anthropic.com/v1/messages',
  anthropicModel: 'claude-fable-5',
  anthropicVersion: '2023-06-01',
  questionsUrl: 'data/questions.json',
} as const;
