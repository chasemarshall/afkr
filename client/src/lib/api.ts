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
import { supabase } from './supabase';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (requestConfig) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  requestConfig.headers = requestConfig.headers ?? {};

  if (token) {
    requestConfig.headers.Authorization = `Bearer ${token}`;
  } else {
    delete requestConfig.headers.Authorization;
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

export const startAccountAuth = (id: string) =>
  api.post<{ user_code: string; verification_uri: string }>(`/accounts/${id}/auth`).then((r) => r.data);

// Servers
export const getServers = () =>
  api.get<Server[]>('/servers').then((r) => r.data);

export const createServer = (data: CreateServerPayload) =>
  api.post<Server>('/servers', data).then((r) => r.data);

export const updateServer = (id: string, data: Partial<CreateServerPayload>) =>
  api.put<Server>(`/servers/${id}`, data).then((r) => r.data);

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
