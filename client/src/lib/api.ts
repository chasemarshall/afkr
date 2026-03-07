import axios from 'axios';
import type {
  Account,
  Server,
  ScheduledCommand,
  CommandHistoryEntry,
  BotState,
  Script,
  CreateAccountPayload,
  CreateServerPayload,
  CreateSchedulePayload,
  CreateScriptPayload,
  UpdateScriptPayload,
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

export const updateAccount = (id: string, data: Partial<Account>) =>
  api.put<Account>(`/accounts/${id}`, data).then((r) => r.data);

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

// Scripts
export const getScripts = () =>
  api.get<Script[]>('/scripts').then((r) => r.data);

export const getScript = (id: string) =>
  api.get<Script>(`/scripts/${id}`).then((r) => r.data);

export const createScript = (data: CreateScriptPayload) =>
  api.post<Script>('/scripts', data).then((r) => r.data);

export const updateScript = (id: string, data: UpdateScriptPayload) =>
  api.put<Script>(`/scripts/${id}`, data).then((r) => r.data);

export const deleteScript = (id: string) =>
  api.delete(`/scripts/${id}`).then((r) => r.data);

export const toggleScript = (id: string) =>
  api.post<Script>(`/scripts/${id}/toggle`).then((r) => r.data);

export const runScript = (id: string) =>
  api.post<{ status: string; script_id: string }>(`/scripts/${id}/run`).then((r) => r.data);
