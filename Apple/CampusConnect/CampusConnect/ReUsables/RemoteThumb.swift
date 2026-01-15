private struct RemoteThumb: View {
    let urlString: String
    var body: some View {
        AsyncImage(url: URL(string: urlString)) { phase in
            switch phase {
            case .success(let image):
                image.resizable().scaledToFill()
            default:
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(.foreground.opacity(0.06))
                    .overlay(Image(systemName: "photo").foregroundStyle(.secondary))
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}