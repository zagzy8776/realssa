import { useShakeToDiscover } from '@/hooks/useShake';
import { useStatusBarSync } from '@/hooks/useStatusBarSync';
import { useOneSignalAutoPrompt } from '@/hooks/useOneSignalAutoPrompt';
import { useBackButton } from '@/hooks/useBackButton';

export default function GlobalHooks() {
  useShakeToDiscover();
  useStatusBarSync();
  useOneSignalAutoPrompt();
  useBackButton();
  return null;
}
