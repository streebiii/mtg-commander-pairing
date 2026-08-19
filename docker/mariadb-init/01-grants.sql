-- Der App-Nutzer bekommt standardmässig nur Rechte auf die eine
-- MARIADB_DATABASE. Prisma braucht für `prisma migrate dev` zusätzlich
-- eine "Shadow"-Datenbank (zum Diffen des Schemas), die es dynamisch
-- anlegt und wieder löscht — dafür braucht der Nutzer CREATE/DROP auf
-- Datenbank-Ebene. Nur für lokale Entwicklung relevant (Produktion nutzt
-- `prisma migrate deploy`, das keine Shadow-DB braucht).
GRANT ALL PRIVILEGES ON *.* TO 'pairing'@'%';
FLUSH PRIVILEGES;
