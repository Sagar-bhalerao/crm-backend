#!/bin/sh
# Run once from the crm-backend folder, AFTER copying in the new files.
# Deletes the old global-settings API. The app_settings table is left in the
# database untouched; drop it later once everything works.
set -e
rm -f src/routes/settings.routes.js \
      src/controllers/settings.controller.js \
      src/services/settings.service.js \
      src/repositories/settings.repository.js \
      src/validators/settings.validator.js
echo "deleted the settings route, controller, service, repository and validator"

echo
echo "Anything below still refers to the old settings API and needs a look:"
grep -rn "settings\.service\|settings\.repository\|settings\.routes\|settings\.controller\|settings\.validator\|TABLES\.settings" src || echo "  nothing, all clear"
