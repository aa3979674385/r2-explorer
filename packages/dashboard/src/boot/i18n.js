import { boot } from "quasar/wrappers";
import i18n from "src/i18n";
import { setI18n } from "src/appUtils";

export default boot(({ app }) => {
  app.use(i18n);
  setI18n(i18n);
});

export { i18n };
