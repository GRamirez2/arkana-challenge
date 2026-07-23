<script setup lang="ts">
import { KeyRound, Lock, ShieldCheck } from 'lucide-vue-next';

import Badge from '@/components/ui/badge.vue';
import Button from '@/components/ui/button.vue';
import Card from '@/components/ui/card.vue';

/**
 * Setup panel that explains the optional OpenAI key and collects the browser
 * session value for the current tab.
 */
const apiKeyDraft = defineModel<string>('apiKeyDraft', { default: '' });

const props = defineProps<{
  setupError: string;
}>();

const emit = defineEmits<{
  (event: 'submit'): void;
  (event: 'continue-without-api-key'): void;
}>();
</script>

<template>
  <section
    class="relative mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-10 lg:px-10"
  >
    <Card
      class="w-full border-slate-200/80 bg-white/90 text-slate-900 shadow-2xl shadow-slate-950/20 backdrop-blur-xl"
    >
      <div class="grid gap-8 p-6 lg:grid-cols-[1.05fr_0.95fr] lg:p-8">
        <div class="space-y-6">
          <Badge class="border-cyan-500/20 bg-cyan-500/10 text-cyan-900">
            Session setup · OpenAI key is optional
          </Badge>

          <div class="space-y-4">
            <h1 class="text-4xl font-semibold tracking-tight text-slate-900">
              Paste your API key to enable OpenAI planning for this browser
              session.
            </h1>
            <p class="max-w-2xl text-base leading-8 text-slate-700 sm:text-lg">
              When you submit a key, the app stores it in session storage so
              only this tab can use it. Each chat request sends that key to the
              backend, which can then use OpenAI to interpret the question and
              choose the right filters or chart mode.
            </p>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <div class="rounded-3xl border border-slate-200 bg-slate-50/90 p-4">
              <div
                class="flex items-center gap-2 text-sm font-medium text-slate-900"
              >
                <ShieldCheck class="h-4 w-4 text-emerald-600" />
                What OpenAI does here
              </div>
              <p class="mt-3 text-sm leading-7 text-slate-700">
                It helps the planner understand your question and return a
                structured response. The actual dataset still comes from the
                backend database.
              </p>
            </div>
            <div class="rounded-3xl border border-slate-200 bg-slate-50/90 p-4">
              <div
                class="flex items-center gap-2 text-sm font-medium text-slate-900"
              >
                <Lock class="h-4 w-4 text-cyan-600" />
                What happens without a key
              </div>
              <p class="mt-3 text-sm leading-7 text-slate-700">
                The app keeps working. It falls back to a local planner, so you
                can still ask questions and explore the chart without OpenAI.
              </p>
            </div>
          </div>

          <div class="rounded-3xl border border-slate-200 bg-slate-50/90 p-4">
            <div
              class="flex items-center gap-2 text-sm font-medium text-slate-900"
            >
              <KeyRound class="h-4 w-4 text-cyan-600" />
              Change the key later
            </div>
            <p class="mt-3 text-sm leading-7 text-slate-700">
              Use the clear button in the main app to remove the saved key and
              restart the session. That returns you to this screen so you can
              paste a different key.
            </p>
          </div>
        </div>

        <div
          class="space-y-4 rounded-[2rem] border border-slate-200 bg-slate-50/90 p-5 text-slate-900 sm:p-6"
        >
          <div>
            <p
              class="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-800"
            >
              OpenAI API key
            </p>
            <h2 class="mt-2 text-2xl font-semibold text-slate-900">
              Start with your preferred session mode
            </h2>
            <p class="mt-3 text-sm leading-7 text-slate-700">
              <span class="font-medium text-slate-900">Session storage</span>
              keeps the key in this tab only. Close the tab and the saved key is
              gone.
            </p>
          </div>

          <form class="space-y-4" @submit.prevent="emit('submit')">
            <label class="block space-y-2">
              <span class="text-sm font-medium text-slate-700">API key</span>
              <input
                v-model="apiKeyDraft"
                type="password"
                autocomplete="off"
                spellcheck="false"
                class="w-full rounded-3xl border border-slate-300 bg-white px-4 py-4 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                placeholder="sk-..."
              />
            </label>

            <div class="flex flex-wrap gap-3">
              <Button type="submit" class="min-w-[180px]">
                Continue with OpenAI
              </Button>
              <Button
                variant="outline"
                class="border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                @click.prevent="emit('continue-without-api-key')"
              >
                Use local fallback
              </Button>
            </div>
          </form>

          <div
            v-if="props.setupError"
            class="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100"
          >
            {{ props.setupError }}
          </div>

          <div class="rounded-3xl border border-slate-200 bg-white p-4">
            <p class="text-sm font-medium text-slate-900">
              What this means for OpenAI
            </p>
            <p class="mt-2 text-sm leading-7 text-slate-700">
              OpenAI is only used as the planner. Your key is not stored in
              localStorage or sent anywhere except the backend request that
              needs it. If you skip this step, the app still works using its
              built-in fallback. That fallback uses simple rules on the server
              to guess the right filters from your question, so you can still
              use the app without entering a key.
            </p>
          </div>
        </div>
      </div>
    </Card>
  </section>
</template>
