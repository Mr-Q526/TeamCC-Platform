// In its own file to avoid circular dependencies
export const FILE_EDIT_TOOL_NAME = 'Edit'

// Permission pattern for granting session-level access to the project's .teamcc/ folder
export const TEAMCC_FOLDER_PERMISSION_PATTERN = '/.teamcc/**'

// Permission pattern for granting session-level access to the global ~/.teamcc/ folder
export const GLOBAL_TEAMCC_FOLDER_PERMISSION_PATTERN = '~/.teamcc/**'

// Backward-compatible aliases for older internal references.
export const CLAUDE_FOLDER_PERMISSION_PATTERN = TEAMCC_FOLDER_PERMISSION_PATTERN
export const GLOBAL_CLAUDE_FOLDER_PERMISSION_PATTERN =
  GLOBAL_TEAMCC_FOLDER_PERMISSION_PATTERN

export const FILE_UNEXPECTEDLY_MODIFIED_ERROR =
  'File has been unexpectedly modified. Read it again before attempting to write it.'
