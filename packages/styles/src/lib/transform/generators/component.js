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

  const allFiles = fs.readdirSync(`${basePath}/components`);
  const lightFiles = allFiles.filter(f => f.endsWith('.json') && !f.includes('-dark'));

  for (const file of lightFiles) {
    const comp = file.replace('.json', '');
    const componentName = `${componentPrefix}-${comp}`;

    // Component-specific tokens at host level (light mode)
    filesArr.push({
      format,
      filter: (token) => {
        const filePath = token.filePath || '';
        return filePath.includes(`components/${comp}.json`);
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

export const generateComponentDarkFiles = () => {
  const filesArr = [];

  const allFiles = fs.readdirSync(`${basePath}/components`);
  const darkFiles = allFiles.filter(f => f.includes('-dark.json'));

  for (const darkFile of darkFiles) {
    const comp = darkFile.replace('-dark.json', '');
    const componentName = `${componentPrefix}-${comp}`;

    filesArr.push({
      format,
      filter: (token) => {
        const filePath = token.filePath || '';
        return filePath.includes(`components/${comp}-dark.json`);
      },
      options: {
        selector: ":host-context([data-theme='dark'])",
        prefix: 'pine',
        outputReferences: true,
      },
      destination: `pine/components/${componentName}/${componentName}.tokens-dark.scss`,
    });
  }
  return filesArr;
};
