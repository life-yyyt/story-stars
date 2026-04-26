import { StoryEditorValues } from '@/src/types/domain';

export const STORY_TITLE_MAX_LENGTH = 120;
export const STORY_BODY_MAX_LENGTH = 12000;

export const normalizeStoryEditorValues = (values: StoryEditorValues): StoryEditorValues => ({
  ...values,
  title: values.title.trim(),
  body: values.body.trim(),
});

export const getStoryEditorValidationMessage = (values: StoryEditorValues) => {
  const normalized = normalizeStoryEditorValues(values);

  if (!normalized.title) {
    return '请给这颗星一个标题。';
  }

  if (!normalized.body) {
    return '请写下一段故事正文。';
  }

  if (normalized.title.length > STORY_TITLE_MAX_LENGTH) {
    return `标题最多 ${STORY_TITLE_MAX_LENGTH} 个字。`;
  }

  if (normalized.body.length > STORY_BODY_MAX_LENGTH) {
    return `正文最多 ${STORY_BODY_MAX_LENGTH} 个字。`;
  }

  return null;
};
