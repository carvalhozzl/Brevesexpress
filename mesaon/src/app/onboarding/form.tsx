"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, fieldA11y } from "@/components/ui/input";
import { FormMessage } from "@/components/ui/form-message";
import { initialActionState } from "@/lib/validation/common";
import { slugify } from "@/lib/validation/restaurant";
import { BRAZIL_TIMEZONES } from "@/lib/timezones";
import { createRestaurantAction } from "./actions";

export function OnboardingForm() {
  const [state, action, pending] = useActionState(createRestaurantAction, initialActionState);
  const [name, setName] = useState(state.values?.name ?? "");
  const [slug, setSlug] = useState(state.values?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(false);
  const e = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-5" noValidate>
      <FormMessage state={state} />
      <Field id="name" label="Nome do estabelecimento" error={e.name}>
        <Input
          {...fieldA11y("name", e.name)}
          value={name}
          onChange={(ev) => {
            setName(ev.target.value);
            if (!slugTouched) setSlug(slugify(ev.target.value));
          }}
          placeholder="Ex.: Restaurante Sabor da Casa"
          autoComplete="organization"
          required
        />
      </Field>
      <Field id="slug" label="Identificador" hint="Usado internamente para identificar o estabelecimento. Ex.: sabor-da-casa" error={e.slug}>
        <Input
          {...fieldA11y("slug", e.slug, true)}
          value={slug}
          onChange={(ev) => {
            setSlugTouched(true);
            setSlug(ev.target.value.toLowerCase());
          }}
          autoCapitalize="none"
          spellCheck={false}
          required
        />
      </Field>
      <Field id="timezone" label="Fuso horário" error={e.timezone}>
        <Select {...fieldA11y("timezone", e.timezone)} defaultValue={state.values?.timezone ?? "America/Sao_Paulo"}>
          {BRAZIL_TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending} loadingText="Criando…">
        Criar estabelecimento
      </Button>
    </form>
  );
}
