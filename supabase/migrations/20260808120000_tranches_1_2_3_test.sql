-- Chantier « 3 tranches réelles » (2026-08-08) — la résidence ne compte en
-- pratique que 3 tranches. Les lettres deviennent des chiffres, la 4e disparaît,
-- et la 5e devient la tranche de test :
--
--   A → 1     B → 2     C → 3     D → (supprimée)     E → T (Test)
--
-- Deux colonnes portent la valeur, toutes deux `text` nullable et jusqu'ici SANS
-- contrainte : public.profiles.tranche et public.admission_requests.tranche.
-- C'est cette absence de CHECK qui a laissé cinq listes de tranches dériver dans
-- le code applicatif ; la migration pose le miroir de `zTranche`
-- (lib/validation/admission.ts) pour fermer la porte.
--
-- ⚠️ LE CAS « D » N'EST PAS TRANCHÉ AUTOMATIQUEMENT. Réaffecter d'office un
-- résident à une autre tranche serait une invention, et le passer à NULL
-- effacerait silencieusement une information qu'il a lui-même saisie. La
-- migration ÉCHOUE donc, avec le décompte exact, s'il reste des lignes en D.
-- Deux façons de la débloquer, au choix, à exécuter AVANT de la rejouer :
--
--   -- (a) les résidents de D n'ont plus de tranche connue :
--   update public.profiles set tranche = null where tranche = 'D';
--   update public.admission_requests set tranche = null where tranche = 'D';
--
--   -- (b) D était en fait la tranche 3 (par exemple) :
--   update public.profiles set tranche = 'C' where tranche = 'D';
--   update public.admission_requests set tranche = 'C' where tranche = 'D';
--
-- Idempotente : les UPDATE sont bornés par un WHERE sur les anciennes valeurs, et
-- la contrainte est recréée proprement.

do $$
declare
  v_profiles bigint;
  v_requests bigint;
begin
  select count(*) into v_profiles from public.profiles where tranche = 'D';
  select count(*) into v_requests from public.admission_requests where tranche = 'D';

  if v_profiles > 0 or v_requests > 0 then
    raise exception
      'Tranche D encore utilisée : % profil(s), % demande(s) d''admission. '
      'Décide de leur sort avant de rejouer cette migration (cf. en-tête du fichier).',
      v_profiles, v_requests;
  end if;
end $$;

-- Conversion des valeurs connues. `where tranche in (...)` rend l'opération
-- rejouable et laisse intactes les lignes déjà converties ou à NULL.
update public.profiles
   set tranche = case tranche
                   when 'A' then '1'
                   when 'B' then '2'
                   when 'C' then '3'
                   when 'E' then 'T'
                 end
 where tranche in ('A', 'B', 'C', 'E');

update public.admission_requests
   set tranche = case tranche
                   when 'A' then '1'
                   when 'B' then '2'
                   when 'C' then '3'
                   when 'E' then 'T'
                 end
 where tranche in ('A', 'B', 'C', 'E');

-- Filet avant de contraindre : si une valeur inattendue traîne (casse
-- différente, saisie libre d'avant l'enum…), on veut un message qui la NOMME
-- plutôt qu'une violation de contrainte opaque.
do $$
declare
  v_bad text;
begin
  select string_agg(distinct quote_literal(tranche), ', ')
    into v_bad
    from (
      select tranche from public.profiles
      union all
      select tranche from public.admission_requests
    ) t
   where tranche is not null
     and tranche not in ('1', '2', '3', 'T');

  if v_bad is not null then
    raise exception
      'Valeurs de tranche inattendues, hors (1, 2, 3, T) : %. '
      'Normalise-les avant de rejouer cette migration.', v_bad;
  end if;
end $$;

-- Miroir DB de `zTranche`. NULL reste autorisé : la tranche est optionnelle
-- (un résident peut l'avoir effacée depuis /profil/parametres).
alter table public.profiles
  drop constraint if exists profiles_tranche_check;
alter table public.profiles
  add constraint profiles_tranche_check
  check (tranche is null or tranche in ('1', '2', '3', 'T'));

alter table public.admission_requests
  drop constraint if exists admission_requests_tranche_check;
alter table public.admission_requests
  add constraint admission_requests_tranche_check
  check (tranche is null or tranche in ('1', '2', '3', 'T'));
