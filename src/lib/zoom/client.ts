import 'server-only';
import { config } from '../config';
import { fakeZoom } from './fake';
import { liveZoom } from './live';
import type { ZoomClient } from './types';

export const zoom: ZoomClient = config.INTEGRATIONS_MODE === 'live' ? liveZoom : fakeZoom;

export type { MeetingInput, Registrant } from './types';
