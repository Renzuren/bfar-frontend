// src/components/PrivacyConsentDialog.jsx
// Data privacy terms a respondent must accept before answering a public
// questionnaire. Shown in English or Tagalog; it cannot be dismissed, only
// agreed to or declined.

import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const CONTENT = {
  en: {
    title: 'Terms and Conditions & Data Privacy Consent',
    intro:
      'Please read the following before answering this questionnaire. Your participation is voluntary.',
    sections: [
      {
        heading: '1. Purpose',
        body: 'This questionnaire is conducted for research, monitoring and evaluation. Your answers will be used to assess the project and to prepare reports and statistics.',
      },
      {
        heading: '2. Information we collect',
        body: 'We collect your name, municipality, barangay and province, a profile photo if the questionnaire asks for one, and your answers to the questions.',
      },
      {
        heading: '3. How your information is used',
        body: 'Your information is used only for the purpose stated above. Results are reported as totals and summaries. Your name and photo will not be published without your permission.',
      },
      {
        heading: '4. Storage and protection',
        body: 'Your information is stored securely and can be accessed only by authorized personnel of the organization conducting this questionnaire. It is kept only as long as needed for the stated purpose, or as required by law.',
      },
      {
        heading: '5. Sharing',
        body: 'Your personal information will not be sold or shared with other parties, unless required by law.',
      },
      {
        heading: '6. Your rights',
        body: 'Under the Data Privacy Act of 2012 (Republic Act No. 10173), you have the right to be informed, to access and correct your information, to object to its processing, to have it erased or blocked, and to withdraw your consent at any time. To exercise these rights, contact the person or office that gave you this questionnaire.',
      },
      {
        heading: '7. Voluntary participation',
        body: 'You may decline to answer this questionnaire, or stop at any time before submitting, without any penalty.',
      },
    ],
    agreeLabel:
      'I have read and understood the above, and I voluntarily consent to the collection and processing of my personal information in accordance with the Data Privacy Act of 2012.',
    agree: 'I Agree',
    decline: 'I Do Not Agree',
  },
  tl: {
    title: 'Mga Tuntunin at Kundisyon at Pahintulot sa Data Privacy',
    intro:
      'Pakibasa muna ang mga sumusunod bago sagutan ang questionnaire na ito. Ang iyong paglahok ay kusang-loob.',
    sections: [
      {
        heading: '1. Layunin',
        body: 'Ang questionnaire na ito ay isinasagawa para sa pananaliksik, pagsubaybay at pagsusuri. Gagamitin ang iyong mga sagot upang suriin ang proyekto at makabuo ng mga ulat at estadistika.',
      },
      {
        heading: '2. Impormasyong kinokolekta',
        body: 'Kinokolekta namin ang iyong pangalan, munisipalidad, barangay at probinsya, larawan mo kung hinihingi ito ng questionnaire, at ang iyong mga sagot sa mga tanong.',
      },
      {
        heading: '3. Paano gagamitin ang iyong impormasyon',
        body: 'Gagamitin lamang ang iyong impormasyon para sa layuning nakasaad sa itaas. Ang mga resulta ay iuulat bilang kabuuan at buod. Hindi ilalathala ang iyong pangalan at larawan nang wala kang pahintulot.',
      },
      {
        heading: '4. Pag-iimbak at proteksyon',
        body: 'Ligtas na iniimbak ang iyong impormasyon at tanging mga awtorisadong tauhan ng organisasyong nagsasagawa ng questionnaire na ito ang makakakita nito. Itatago lamang ito hangga\'t kailangan para sa nakasaad na layunin, o ayon sa itinatakda ng batas.',
      },
      {
        heading: '5. Pagbabahagi',
        body: 'Hindi ibebenta o ibabahagi sa ibang partido ang iyong personal na impormasyon, maliban kung iniaatas ng batas.',
      },
      {
        heading: '6. Ang iyong mga karapatan',
        body: 'Sa ilalim ng Data Privacy Act of 2012 (Republic Act No. 10173), may karapatan kang malaman kung paano ginagamit ang iyong impormasyon, makita at maitama ito, tumutol sa pagproseso nito, ipabura o ipaharang ito, at bawiin ang iyong pahintulot anumang oras. Upang magamit ang mga karapatang ito, makipag-ugnayan sa tao o opisinang nagbigay sa iyo ng questionnaire na ito.',
      },
      {
        heading: '7. Kusang-loob na paglahok',
        body: 'Maaari kang tumangging sumagot sa questionnaire na ito, o huminto anumang oras bago ito isumite, nang walang anumang parusa.',
      },
    ],
    agreeLabel:
      'Nabasa at naintindihan ko ang nasa itaas, at kusang-loob akong pumapayag sa pagkolekta at pagproseso ng aking personal na impormasyon alinsunod sa Data Privacy Act of 2012.',
    agree: 'Sumasang-ayon Ako',
    decline: 'Hindi Ako Sumasang-ayon',
  },
};

const LANGUAGES = [
  { key: 'en', label: 'English' },
  { key: 'tl', label: 'Tagalog' },
];

export default function PrivacyConsentDialog({ open, onAgree, onDecline }) {
  const [lang, setLang] = useState('en');
  const [checked, setChecked] = useState(false);
  const text = CONTENT[lang];

  const stay = (e) => e.preventDefault();

  return (
    <Dialog open={open}>
      {/* [&>button]:hidden removes the built-in close X: consent is agree or decline. */}
      <DialogContent
        onEscapeKeyDown={stay}
        onPointerDownOutside={stay}
        onInteractOutside={stay}
        className="flex max-h-[90vh] w-[calc(100%-2rem)] flex-col gap-4 rounded-2xl p-5 sm:max-w-xl sm:p-6 [&>button]:hidden"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
          </div>
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5" role="group" aria-label="Language / Wika">
            {LANGUAGES.map((l) => (
              <button
                key={l.key}
                type="button"
                onClick={() => setLang(l.key)}
                aria-pressed={lang === l.key}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  lang === l.key
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <DialogHeader>
          <DialogTitle className="text-left text-lg leading-snug">{text.title}</DialogTitle>
          <DialogDescription className="text-left">{text.intro}</DialogDescription>
        </DialogHeader>

        <div
          lang={lang}
          tabIndex={0}
          className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/60 p-4"
        >
          {text.sections.map((s) => (
            <div key={s.heading}>
              <p className="text-sm font-semibold text-slate-800">{s.heading}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{s.body}</p>
            </div>
          ))}
        </div>

        <label htmlFor="privacy-consent" className="flex cursor-pointer items-start gap-3">
          <Checkbox
            id="privacy-consent"
            checked={checked}
            onCheckedChange={(c) => setChecked(c === true)}
            className="mt-0.5"
          />
          <span className="text-sm leading-relaxed text-slate-700">{text.agreeLabel}</span>
        </label>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button type="button" variant="outline" onClick={onDecline} className="sm:order-1">
            {text.decline}
          </Button>
          <Button
            type="button"
            onClick={onAgree}
            disabled={!checked}
            className="order-first bg-[#646cff] text-white hover:bg-[#535bf2] sm:order-2"
          >
            {text.agree}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
