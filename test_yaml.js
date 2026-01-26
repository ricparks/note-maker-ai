
function extractYamlFromMarkdown(content) {
    // Look for ```yaml or just ``` blocks
    const match = content.match(/^```(?:yaml)?\s*([\s\S]*?)\s*```/m);
    if (match) {
        return "CODE_BLOCK_MATCH";
    }
    return "WHOLE_CONTENT";
}

const frontmatterCase = `---
key: value
---
# Some Markdown
`;

const result = extractYamlFromMarkdown(frontmatterCase);
console.log("Frontmatter Case Result:", result);

if (result === "WHOLE_CONTENT") {
    console.log("ISSUE: It returned the whole content including markdown, which usually breaks parseYaml.");
}
