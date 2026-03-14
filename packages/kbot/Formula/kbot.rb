class Kbot < Formula
  desc "Local-first AI agent for your terminal with 39 specialists and 167 tools"
  homepage "https://kernel.chat"
  url "https://registry.npmjs.org/@kernel.chat/kbot/-/kbot-2.13.1.tgz"
  # TODO: Replace with actual checksum from:
  #   curl -sL https://registry.npmjs.org/@kernel.chat/kbot/-/kbot-2.13.1.tgz | shasum -a 256
  sha256 ""
  license "MIT"

  depends_on "node@20"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink libexec.glob("bin/*")
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/kbot --version")
  end
end
