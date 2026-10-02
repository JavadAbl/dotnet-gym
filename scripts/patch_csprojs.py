"""Patch module csproj files: add ASP.NET Core FrameworkReference and exclude nested Public/ sources from parent compilation."""
import glob

for path in glob.glob('/home/z/my-project/backend/src/Modules/*/Gms.Modules.*.csproj'):
    src = open(path).read()
    if 'FrameworkReference' not in src:
        injection = (
            '  <ItemGroup>\n'
            '    <Compile Remove="Public/**/*.cs" />\n'
            '    <FrameworkReference Include="Microsoft.AspNetCore.App" />\n'
            '  </ItemGroup>\n'
            '</Project>'
        )
        src = src.replace('</Project>', injection)
        open(path, 'w').write(src)
        print(f'patched {path}')

print('CSPROJ PATCH DONE')
