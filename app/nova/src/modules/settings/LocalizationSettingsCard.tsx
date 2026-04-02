/**
 * Why: Provide a focused UI primitive for localization preferences in Nova settings.
 * What: Renders locale/timezone/hour-cycle controls plus live date/number preview.
 * How: Binds directly to LocalizationProvider context and updates snapshot state immediately.
 */

import { Globe, Languages, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useLocalization, SUPPORTED_LOCALES } from "@/modules/settings/LocalizationProvider";

const COMMON_TIME_ZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Singapore",
] as const;

export function LocalizationSettingsCard(): JSX.Element {
  const { snapshot, updateSnapshot, resetSnapshot, formatDateTime, formatNumber } = useLocalization();

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Languages className="h-4 w-4" /> Localization & language scaffold
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          ChatGPT-UI pass scaffold: capture UI language and locale formatting preferences before full translation rollout.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">UI locale</p>
            <Select value={snapshot.uiLocale} onValueChange={(value) => updateSnapshot({ uiLocale: value as (typeof SUPPORTED_LOCALES)[number] })}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_LOCALES.map((locale) => (
                  <SelectItem key={locale} value={locale}>
                    {locale}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Data locale</p>
            <Select value={snapshot.dataLocale} onValueChange={(value) => updateSnapshot({ dataLocale: value as (typeof SUPPORTED_LOCALES)[number] })}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_LOCALES.map((locale) => (
                  <SelectItem key={locale} value={locale}>
                    {locale}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Timezone</p>
            <Select value={snapshot.timeZone} onValueChange={(value) => updateSnapshot({ timeZone: value })}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMMON_TIME_ZONES.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    {zone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Clock format</p>
            <Select value={snapshot.hourCycle} onValueChange={(value) => updateSnapshot({ hourCycle: value as "h12" | "h24" })}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="h12">12-hour</SelectItem>
                <SelectItem value="h24">24-hour</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        <div className="grid gap-3 rounded-lg border border-border/60 bg-background/60 p-3 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Globe className="h-3.5 w-3.5" />
            <span>Preview with current localization settings</span>
          </div>
          <p className="text-sm text-foreground">Date/time: {formatDateTime(new Date())}</p>
          <p className="text-sm text-foreground">Number: {formatNumber(9876543.21)}</p>
        </div>

        <div className="flex justify-end">
          <Button type="button" size="sm" variant="ghost" onClick={resetSnapshot}>
            <RotateCcw className="mr-1 h-4 w-4" /> Reset localization
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
