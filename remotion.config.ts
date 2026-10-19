import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setConcurrency(null);
// Draw frames on the GPU via ANGLE/DirectX (~30% faster than software on an RTX 4070 laptop, same frames).
Config.setChromiumOpenGlRenderer("angle");
