Phase185
- Кнопка «Поділитися» у standalone Final Plan (#board-modal) тепер ділиться PNG-зображенням поточної зміни, а не лише URL.
- Додано загальний helper shareBoardAsImage() у final-plan-actions.js.
- Якщо file share недоступний, fallback: копіювання PNG у clipboard, далі збереження PNG.
- Preview share у final-plan-preview.js переведено на image-share helper.
- ui-compat share handler тепер ігнорує defaultPrevented кліки та не заважає standalone image-share.
