#!/usr/bin/env python3
"""Shabbat times for the Weekly Letter, calculated locally.

Sunset comes from the NOAA solar position equations (the method behind the
NOAA Solar Calculator). Candle lighting is 18 minutes before sunset and
havdalah is 42 minutes after, the same convention the centre's site uses.

Standard library only. Usage:

    python3 newsletter/tools/shabbat_times.py 2026-10-30 2026-12-31

Prints one line per Friday in the range, with candle lighting, sunset and
havdalah in local Oakland time. Accuracy is within about a minute.
"""

import math
import sys
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

LAT = 37.8107           # Oakland, degrees north
LON = -122.2437         # Oakland, degrees east (negative = west)
TZ = ZoneInfo("America/Los_Angeles")
CANDLES_MINUTES = 18    # before sunset
HAVDALAH_MINUTES = 42   # after sunset
SUNSET_ZENITH = 90.833  # 90 degrees plus refraction and the sun's disc


def julian_day(d):
    """Julian day at 00:00 UTC on date d."""
    y, m = d.year, d.month
    if m <= 2:
        y -= 1
        m += 12
    a = y // 100
    b = 2 - a + a // 4
    return int(365.25 * (y + 4716)) + int(30.6001 * (m + 1)) + d.day + b - 1524.5


def sunset_utc_minutes(d):
    """Sunset for date d at Oakland, as minutes after 00:00 UTC of d."""
    jd0 = julian_day(d)
    # Start from solar noon, then refine a few times at the sunset instant.
    minutes = 720.0
    for _ in range(3):
        t = (jd0 + minutes / 1440.0 - 2451545.0) / 36525.0
        geom_mean_lon = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360
        geom_mean_anom = 357.52911 + t * (35999.05029 - 0.0001537 * t)
        ecc = 0.016708634 - t * (0.000042037 + 0.0000001267 * t)
        m = math.radians(geom_mean_anom)
        centre = (math.sin(m) * (1.914602 - t * (0.004817 + 0.000014 * t))
                  + math.sin(2 * m) * (0.019993 - 0.000101 * t)
                  + math.sin(3 * m) * 0.000289)
        true_lon = geom_mean_lon + centre
        omega = 125.04 - 1934.136 * t
        app_lon = true_lon - 0.00569 - 0.00478 * math.sin(math.radians(omega))
        mean_obliq = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60
        obliq = mean_obliq + 0.00256 * math.cos(math.radians(omega))
        decl = math.asin(math.sin(math.radians(obliq)) * math.sin(math.radians(app_lon)))

        y = math.tan(math.radians(obliq / 2)) ** 2
        l0 = math.radians(geom_mean_lon)
        eq_time = 4 * math.degrees(
            y * math.sin(2 * l0)
            - 2 * ecc * math.sin(m)
            + 4 * ecc * y * math.sin(m) * math.cos(2 * l0)
            - 0.5 * y * y * math.sin(4 * l0)
            - 1.25 * ecc * ecc * math.sin(2 * m))

        lat = math.radians(LAT)
        cos_ha = ((math.cos(math.radians(SUNSET_ZENITH))
                   - math.sin(lat) * math.sin(decl))
                  / (math.cos(lat) * math.cos(decl)))
        ha = math.degrees(math.acos(cos_ha))
        solar_noon = 720 - 4 * LON - eq_time
        minutes = solar_noon + 4 * ha
    return minutes


def local_sunset(d):
    """Sunset for date d as a timezone-aware local datetime."""
    utc = datetime(d.year, d.month, d.day, tzinfo=timezone.utc)
    return (utc + timedelta(minutes=sunset_utc_minutes(d))).astimezone(TZ)


def clock(dt):
    """Clock time such as 5:54 PM, rounded to the nearest minute."""
    dt = dt.replace(second=0, microsecond=0)
    if dt.second >= 30:
        dt += timedelta(minutes=1)
    hour12 = dt.hour % 12 or 12
    return f"{hour12}:{dt.minute:02d} {'AM' if dt.hour < 12 else 'PM'}"


def shabbat_times(friday):
    """Candle lighting, sunset and havdalah for the Shabbat that starts on friday."""
    sunset = local_sunset(friday)
    saturday = friday + timedelta(days=1)
    havdalah = local_sunset(saturday) + timedelta(minutes=HAVDALAH_MINUTES)
    candles = sunset - timedelta(minutes=CANDLES_MINUTES)
    return candles, sunset, havdalah


def main(argv):
    start = date.fromisoformat(argv[1]) if len(argv) > 1 else date.today()
    end = date.fromisoformat(argv[2]) if len(argv) > 2 else start + timedelta(days=60)
    friday = start + timedelta((4 - start.weekday()) % 7)
    while friday <= end:
        candles, sunset, havdalah = shabbat_times(friday)
        print(f"{friday:%a %b %d}  candles {clock(candles)}  sunset {clock(sunset)}  "
              f"havdalah {clock(havdalah)} ({friday + timedelta(days=1):%a %b %d})")
        friday += timedelta(days=7)


if __name__ == "__main__":
    main(sys.argv)
