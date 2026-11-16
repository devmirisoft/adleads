// Public API of this module — import from '@/modules/settings' only. App settings + staff users.
export {
  getAllSettings,
  getBotMessages,
  getMessage,
  getSetting,
  updateSettings,
} from './services/settings';
export {
  createUser,
  listStaff,
  listUsers,
  setUserActive,
  setUserRole,
  userNames,
  type UserListItem,
} from './services/users';
export {
  addUserAction,
  saveBotMessageAction,
  saveSettingsAction,
  setUserActiveAction,
  setUserRoleAction,
} from './services/actions';
export {
  ROLE_LABEL,
  SETTINGS,
  settingsFormSchema,
  type AllSettings,
  type SettingKey,
  type SettingValue,
} from './constants/keys';
export type { BotMessageKey } from './constants/messages';
export { BotMessageEditor } from './components/BotMessageEditor';
export { SettingsForm } from './components/SettingsForm';
export { UsersTable } from './components/UsersTable';
