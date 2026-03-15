class Kbot < Formula
  desc "Local-first AI agent for your terminal with 11 specialist agents and 214 tools"
  homepage "https://kernel.chat"
  url "https://registry.npmjs.org/@kernel.chat/kbot/-/kbot-2.13.1.tgz"
  sha256 "6eb45fff3aad056e69e15bcb16876824d5f342eb16894d5f9ecf2ac6e4ebeab5"
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
