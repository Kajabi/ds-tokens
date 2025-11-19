import fs from 'fs-extra'
import { outputReferencesTransformed } from "style-dictionary/utils";
import { componentFilter } from "../filters/index.js";
import { basePath } from "../utils.js";

const componentPrefix = 'pds';
const format = "css/variables-host";

// for each component, filter those specific component tokens and output them
// to the component folder where the component source code will live
export const generateComponentFiles = () => {
  const filesArr = [];

  // Generates a list of components from the tokens/components folder
  const components = fs.readdirSync(`${basePath}/components`).map((comp) => comp.replace(/.json$/g, ""));

  for (const comp of components) {
    const componentName = `${componentPrefix}-${comp}`;

    // Component-specific tokens at host level (light mode)
    filesArr.push({
      format,
      filter: (token) => {
        const filePath = token.filePath || '';
        return filePath.includes(`components/${comp}/light.json`) ||
               filePath.includes(`components/${comp}/light/`);
      },
      options: {
        selector: ":host",
        prefix: 'pine',
        outputReferences: true,
      },
      destination: `pine/components/${componentName}/${componentName}.tokens.scss`,
    });
  }
  return filesArr;
};
