import { z } from 'zod';

export const FlightStatus = z.enum([
  'scheduled',
  'boarding',
  'airborne',
  'landed',
  'cancelled',
  'diverted',
  'unknown'
]);
export type FlightStatus = z.infer<typeof FlightStatus>;

export const FlightSource = z.enum(['aerodatabox', 'airlabs', 'aviationstack', 'unknown']);
export type FlightSource = z.infer<typeof FlightSource>;

export const ResolvedFlight = z.object({
  flight_no: z.string(),
  flight_date: z.string(),
  origin_iata: z.string().nullable(),
  dest_iata: z.string().nullable(),
  sched_dep_utc: z.number().int().nullable(),
  sched_arr_utc: z.number().int().nullable(),
  status: FlightStatus,
  assigned_hex: z.string().nullable(),
  assigned_reg: z.string().nullable(),
  aircraft_type: z.string().nullable(),
  airline_iata: z.string().nullable(),
  airline_icao: z.string().nullable(),
  source: FlightSource
});
export type ResolvedFlight = z.infer<typeof ResolvedFlight>;

export const AircraftRecord = z.object({
  hex: z.string(),
  reg: z.string().nullable(),
  type_icao: z.string().nullable(),
  type_name: z.string().nullable(),
  operator: z.string().nullable(),
  first_flight_date: z.string().nullable(),
  delivery_date: z.string().nullable(),
  build_year: z.number().int().nullable(),
  prev_regs: z
    .array(
      z.object({ reg: z.string(), from: z.string().nullable(), to: z.string().nullable() })
    )
    .nullable(),
  source: z.string()
});
export type AircraftRecord = z.infer<typeof AircraftRecord>;

export const AircraftPhoto = z.object({
  url: z.string(),
  thumbnail: z.string().nullable(),
  photographer: z.string(),
  link: z.string()
});
export type AircraftPhoto = z.infer<typeof AircraftPhoto>;
