import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const imageDir = path.join(root, "apps", "web", "public", "images");
const outputDir = path.join(imageDir, "generated");

const backgroundPresets = [
  { suffix: "desktop", width: 1920, height: 1080 },
  { suffix: "wide", width: 2560, height: 1080 },
  { suffix: "portrait", width: 1080, height: 1920 },
];

const jobs = [
  {
    name: "bronze-dragon",
    source: "bronze-dragon.png",
    presets: backgroundPresets,
  },
  {
    name: "silver-dragon",
    source: "silver-dragon.png",
    presets: backgroundPresets,
  },
  {
    name: "copper-dragon",
    source: "copper-dragon.png",
    presets: backgroundPresets,
  },
  {
    name: "chip-poole",
    source: "chip-poole.png",
    presets: [{ suffix: "card", width: 1440, height: 720, mode: "cover-crop", focusY: 0.36 }],
  },
  {
    name: "sean-poole",
    source: "sean-poole.png",
    presets: [{ suffix: "card", width: 1440, height: 720, mode: "cover-crop", focusY: 0.48 }],
  },
  {
    name: "lesley-poole",
    source: "lesley-poole.png",
    presets: [{ suffix: "card", width: 1440, height: 720, mode: "cover-crop", focusY: 0.46 }],
  },
  {
    name: "chris-glynn",
    source: "chris-glynn.png",
    presets: [{ suffix: "card", width: 1440, height: 720, mode: "cover-crop", focusY: 0.5 }],
  },
  {
    name: "michael-hewson",
    source: "michael-hewson.png",
    presets: [{ suffix: "card", width: 1440, height: 720, mode: "cover-crop", focusY: 0.46 }],
  },
  {
    name: "larry-mchale",
    source: "larry-mchale.png",
    presets: [{ suffix: "card", width: 1440, height: 720, mode: "cover-crop", focusY: 0.44 }],
  },
];

async function imageBuffer(sourcePath, width, height, fit, options = {}) {
  let pipeline = sharp(sourcePath).resize({
    width,
    height,
    fit,
    position: options.position ?? "center",
    withoutEnlargement: options.withoutEnlargement ?? false,
  });

  if (options.blur) {
    pipeline = pipeline.blur(options.blur);
  }

  if (options.modulate) {
    pipeline = pipeline.modulate(options.modulate);
  }

  return pipeline.toBuffer();
}

async function createContainedCanvas(job, sourcePath, preset) {
  const { width, height } = preset;
  const backdrop = await imageBuffer(sourcePath, width, height, "cover", {
    blur: 28,
    modulate: { brightness: 0.62, saturation: 0.9 },
  });
  const foreground = await imageBuffer(sourcePath, width, height, "contain", {
    withoutEnlargement: false,
  });

  const outFile = path.join(outputDir, `${job.name}-${preset.suffix}.webp`);

  await sharp(backdrop)
    .composite([{ input: foreground, gravity: "center" }])
    .webp({ quality: 86, effort: 5 })
    .toFile(outFile);

  return outFile;
}

async function createCoverCrop(job, sourcePath, preset) {
  const { width, height } = preset;
  const metadata = await sharp(sourcePath).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error(`Could not read image dimensions for ${job.source}`);
  }

  const targetRatio = width / height;
  const sourceRatio = metadata.width / metadata.height;
  let cropWidth = metadata.width;
  let cropHeight = metadata.height;

  if (sourceRatio > targetRatio) {
    cropWidth = Math.round(metadata.height * targetRatio);
  } else {
    cropHeight = Math.round(metadata.width / targetRatio);
  }

  const focusX = preset.focusX ?? 0.5;
  const focusY = preset.focusY ?? 0.5;
  const left = Math.max(0, Math.round((metadata.width - cropWidth) * focusX));
  const top = Math.max(0, Math.round((metadata.height - cropHeight) * focusY));
  const outFile = path.join(outputDir, `${job.name}-${preset.suffix}.webp`);

  await sharp(sourcePath)
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .resize({ width, height, fit: "cover" })
    .webp({ quality: 88, effort: 5 })
    .toFile(outFile);

  return outFile;
}

await fs.mkdir(outputDir, { recursive: true });

const written = [];

for (const job of jobs) {
  const sourcePath = path.join(imageDir, job.source);

  for (const preset of job.presets) {
    if (preset.mode === "cover-crop") {
      written.push(await createCoverCrop(job, sourcePath, preset));
    } else {
      written.push(await createContainedCanvas(job, sourcePath, preset));
    }
  }
}

for (const file of written) {
  const relative = path.relative(root, file);
  console.log(`prepared ${relative}`);
}
