Phase178
- виправлено кнопку "Зберегти шаблон"
- причина: js/import-template-presets.js викликав неіснуючу локальну змінну F(), через що збереження шаблону падало і не писало mapping у LocalStorage
- тепер saveImportTemplate:
  - спочатку коректно збирає поточні select mapping через wiz.collectMappingSelections()
  - зберігає mapping, visibleOptionalColumns і customOptionalDefs у KEY_IMPORT_TEMPLATES
  - повертає збережений шаблон
