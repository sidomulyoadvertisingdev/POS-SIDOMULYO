const updateSourceUrl = String(
  process.env.VELOPACK_UPDATE_URL || 'https://sidomulyoadvertisingdev.github.io/POS-SIDOMULYO'
)
  .trim()
  .replace(/\/+$/, '');

const isPlaceholderUrl = (
  !updateSourceUrl
  || updateSourceUrl.includes('USERNAME.github.io')
  || updateSourceUrl.includes('REPO_NAME')
);

module.exports = {
  updateSourceUrl,
  isAutoUpdateEnabled: !isPlaceholderUrl,
  autoCheckDelayMs: 15 * 1000,
};
