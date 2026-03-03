import axios from 'axios';
import type {
  Account,
  Server,
  ScheduledCommand,
  CommandHistoryEntry,
  BotState,
  CreateAccountPayload,
  CreateServerPayload,
  CreateSchedulePayload,
} from '@afkr/shared';

const ADMIN_API_KEY = import.meta.env.VITE_ADMIN_API_KEY as string | undefined;
const ACCESS_TOKEN_STORAGE_KEY = 'afkr_access_token';

function getAccessToken(): string | null {
  try {
    return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((requestConfig) => {
  const token = getAccessToken();
  requestConfig.headers = requestConfig.headers ?? {};

  if (token) {
    requestConfig.headers.Authorization = `Bearer ${token}`;
  } else {
    delete requestConfig.headers.Authorization;
  }

  if (ADMIN_API_KEY) {
    requestConfig.headers['x-api-key'] = ADMIN_API_KEY;
  }

  return requestConfig;
});

// Accounts
export const getAccounts = () =>
  api.get<Account[]>('/accounts').then((r) => r.data);

export const createAccount = (data: CreateAccountPayload) =>
  api.post<Account>('/accounts', data).then((r) => r.data);

export const deleteAccount = (id: string) =>
  api.delete(`/accounts/${id}`).then((r) => r.data);

// Servers
export const getServers = () =>
  api.get<Server[]>('/servers').then((r) => r.data);

export const createServer = (data: CreateServerPayload) =>
  api.post<Server>('/servers', data).then((r) => r.data);

export const deleteServer = (id: string) =>
  api.delete(`/servers/${id}`).then((r) => r.data);

// Schedules
export const getSchedules = () =>
  api.get<ScheduledCommand[]>('/schedules').then((r) => r.data);

export const createSchedule = (data: CreateSchedulePayload) =>
  api.post<ScheduledCommand>('/schedules', data).then((r) => r.data);

export const deleteSchedule = (id: string) =>
  api.delete(`/schedules/${id}`).then((r) => r.data);

export const toggleSchedule = (id: string) =>
  api.post<ScheduledCommand>(`/schedules/${id}/toggle`).then((r) => r.data);

// Command History
export const getCommandHistory = () =>
  api.get<CommandHistoryEntry[]>('/bots/history').then((r) => r.data);

// Bot States
export const getBotStates = () =>
  api.get<BotState[]>('/bots/states').then((r) => r.data);
