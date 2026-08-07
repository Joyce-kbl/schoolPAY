-- @Nathan Monga_07/08/2026  :  Effacer tout ce qui se trouve dans les tables en rapport avec les paiments et les frais 07/08/2026 
PRAGMA foreign_keys = ON;

BEGIN TRANSACTION;

DELETE FROM paiements;
DELETE FROM factures;
DELETE FROM frais_attendus_classe;
DELETE FROM categories_frais;

DELETE FROM sqlite_sequence
WHERE name IN (
    'paiements',
    'factures',
    'frais_attendus_classe',
    'categories_frais'
);

COMMIT;